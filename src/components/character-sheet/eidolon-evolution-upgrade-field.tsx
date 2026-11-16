'use client';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '~/components/ui/form';
import { Input } from '~/components/ui/input';
import { pointCount } from '~/lib/character-sheet-eidolon-progression';
import { progressionInput } from './companion-progression-number-field';
import { fieldLabel } from './sheet-parts';
import type {
  EidolonEvolutionPickerForm,
  EvolutionCatalogEntry,
} from './use-eidolon-evolution-picker-form';

type Upgrade = NonNullable<EvolutionCatalogEntry['upgrade']>;

/** How many of the chosen evolution's upgrades to buy, with their cost, maximum and level. */
export function EidolonEvolutionUpgradeField({
  form,
  upgrade,
  isLocked,
}: {
  form: EidolonEvolutionPickerForm;
  upgrade: Upgrade;
  isLocked: boolean;
}) {
  return (
    <FormField
      control={form.control}
      name="upgrades"
      render={({ field, fieldState }) => (
        <FormItem className="max-w-64 gap-1">
          <FormLabel className={fieldLabel}>{upgrade.label}</FormLabel>
          <FormControl>
            <Input
              {...field}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="0"
              disabled={isLocked}
              className={progressionInput}
            />
          </FormControl>
          <FormDescription className="text-xs">
            {`${pointCount(upgrade.cost)} each, up to ${upgrade.max}.${
              upgrade.minimumLevel !== undefined
                ? ` Summoner level ${upgrade.minimumLevel}.`
                : ''
            }`}
          </FormDescription>
          <FormMessage
            role={fieldState.error ? 'alert' : undefined}
            className="text-xs"
          />
        </FormItem>
      )}
    />
  );
}
