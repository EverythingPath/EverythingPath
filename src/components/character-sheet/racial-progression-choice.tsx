'use client';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '~/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { fieldLabel } from './sheet-parts';
import type { useRacialStatisticsForm } from './use-racial-statistics-form';

type Form = ReturnType<typeof useRacialStatisticsForm>['form'];

export const babOptions = [
  { value: 'full', label: 'Full' },
  { value: 'threeQuarters', label: 'Three quarters' },
  { value: 'half', label: 'Half' },
] as const;
export const saveOptions = [
  { value: 'good', label: 'Good' },
  { value: 'poor', label: 'Poor' },
] as const;

/** One of the progression's fixed choices: base attack or a save. */
export function RacialProgressionChoice({
  form,
  name,
  label,
  options,
  disabled,
}: {
  form: Form;
  name:
    | 'progression.bab'
    | 'progression.saves.fort'
    | 'progression.saves.ref'
    | 'progression.saves.will';
  label: string;
  options: readonly { value: string; label: string }[];
  disabled: boolean;
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field, fieldState }) => (
        <FormItem className="min-w-0 content-start gap-1">
          <FormLabel className={fieldLabel}>{label}</FormLabel>
          <Select
            value={field.value}
            onValueChange={field.onChange}
            disabled={disabled}
          >
            <FormControl>
              <SelectTrigger
                aria-label={label}
                className="h-10 w-full rounded-none font-mono text-sm md:h-8 md:py-1"
              >
                <SelectValue />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage
            role={fieldState.error ? 'alert' : undefined}
            className="text-xs"
          />
        </FormItem>
      )}
    />
  );
}
