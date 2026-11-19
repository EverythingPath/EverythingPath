'use client';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '~/components/ui/form';
import { Input } from '~/components/ui/input';
import { progressionInput } from './companion-progression-number-field';
import { fieldLabel } from './sheet-parts';
import type { EidolonProgressionForm } from './use-eidolon-progression-form';

/**
 * How much of the table armor bonus the summoner takes as an armor bonus;
 * the rest is natural armor. Empty records none as armor.
 */
export function EidolonArmorSplitField({
  form,
  disabled,
}: {
  form: EidolonProgressionForm;
  disabled: boolean;
}) {
  return (
    <FormField
      control={form.control}
      name="armorBonusAsArmor"
      render={({ field, fieldState }) => (
        <FormItem className="max-w-48 gap-1">
          <FormLabel className={fieldLabel}>Armor bonus as armor</FormLabel>
          <FormControl>
            <Input
              {...field}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="0"
              disabled={disabled}
              className={progressionInput}
            />
          </FormControl>
          <p className="text-muted-foreground text-xs">
            The rest of the table armor bonus is natural armor.
          </p>
          <FormMessage
            role={fieldState.error ? 'alert' : undefined}
            className="text-xs [overflow-wrap:anywhere]"
          />
        </FormItem>
      )}
    />
  );
}
