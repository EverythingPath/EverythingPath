'use client';
import { useId } from 'react';
import { Checkbox } from '~/components/ui/checkbox';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '~/components/ui/form';
import { Input } from '~/components/ui/input';
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group';
import { cn } from '~/lib/utils';
import { fieldLabel } from './sheet-parts';
import type { useCreationSettingsForm } from './use-sheet-forms';

type SettingsControl = ReturnType<
  typeof useCreationSettingsForm
>['form']['control'];

type FieldProps = { control: SettingsControl; isReadOnly: boolean };

const abilityMethods = [
  { value: 'pointBuy', label: 'Point buy' },
  { value: 'rolled', label: 'Rolled' },
] as const;

export function AbilityMethodField({ control, isReadOnly }: FieldProps) {
  const labelId = useId();
  return (
    <FormField
      control={control}
      name="abilityMethod"
      render={({ field }) => (
        <div className="flex flex-col gap-1">
          <span id={labelId} className={cn(fieldLabel, 'mb-1')}>
            Ability method
          </span>
          <RadioGroup
            aria-labelledby={labelId}
            name={field.name}
            value={field.value}
            disabled={isReadOnly}
            onBlur={field.onBlur}
            onValueChange={field.onChange}
            className="grid-cols-2"
          >
            {abilityMethods.map((method) => (
              <RadioGroupItem key={method.value} value={method.value}>
                {method.label}
              </RadioGroupItem>
            ))}
          </RadioGroup>
        </div>
      )}
    />
  );
}

/** A count or budget: typed as text so a draft is kept, read as a number. */
export function NumberSettingField({
  control,
  isReadOnly,
  name,
  label,
}: FieldProps & { name: 'pointBuyBudget' | 'traitCount'; label: string }) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FormItem className="gap-1">
          <FormLabel className={fieldLabel}>{label}</FormLabel>
          <FormControl>
            <Input
              {...field}
              disabled={isReadOnly}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              className="h-10 w-20 text-center font-mono md:h-8"
            />
          </FormControl>
          <FormMessage
            role={fieldState.error ? 'alert' : undefined}
            className="max-w-56"
          />
        </FormItem>
      )}
    />
  );
}

export function CampaignTraitField({ control, isReadOnly }: FieldProps) {
  return (
    <FormField
      control={control}
      name="campaignTraitRequired"
      render={({ field }) => (
        <FormItem className="gap-1">
          <span aria-hidden className={fieldLabel}>
            Campaign trait
          </span>
          <FormLabel className="min-h-10 cursor-pointer gap-2 font-mono text-sm font-normal md:min-h-8">
            <FormControl>
              <Checkbox
                name={field.name}
                ref={field.ref}
                checked={field.value}
                disabled={isReadOnly}
                onBlur={field.onBlur}
                onCheckedChange={field.onChange}
              />
            </FormControl>
            <span>
              <span className="sr-only">Campaign trait</span> required
            </span>
          </FormLabel>
        </FormItem>
      )}
    />
  );
}
