'use client';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '~/components/ui/form';
import { Input } from '~/components/ui/input';
import type { CompanionFieldProps } from './companion-props';
import { fieldLabel } from './sheet-parts';

/** A plain text field with its own label and in-place error. */
export function CompanionTextField({
  controller,
  isDisabled,
  name,
  label,
  autoFocus = false,
}: CompanionFieldProps & {
  name: 'name' | 'sourceLabel';
  label: string;
  autoFocus?: boolean;
}) {
  return (
    <FormField
      control={controller.form.control}
      name={name}
      render={({ field, fieldState }) => (
        <FormItem className="gap-0.5">
          <FormLabel className={fieldLabel}>{label}</FormLabel>
          <FormControl>
            <Input
              {...field}
              autoFocus={autoFocus}
              autoComplete="off"
              disabled={isDisabled}
              className="h-11 md:h-8"
            />
          </FormControl>
          <FormMessage role={fieldState.error ? 'alert' : undefined} />
        </FormItem>
      )}
    />
  );
}
