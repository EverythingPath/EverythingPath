'use client';
import { useId } from 'react';
import { FormControl, FormField, FormItem } from '~/components/ui/form';
import {
  EidolonVersionCards,
  type EidolonVersionChoice,
} from './eidolon-version-cards';
import { fieldLabel } from './sheet-parts';
import type { EidolonProgressionForm } from './use-eidolon-progression-form';

/**
 * The editor's version choice: the two version cards, with the promise the
 * record keeps. A change writes the version alone; the subtype and every
 * evolution stay recorded, counting or not.
 */
export function EidolonVersionField({
  form,
  versions,
  disabled,
  reasonId,
}: {
  form: EidolonProgressionForm;
  versions: readonly EidolonVersionChoice[];
  disabled: boolean;
  reasonId: string | undefined;
}) {
  const labelId = useId();
  return (
    <FormField
      control={form.control}
      name="version"
      render={({ field }) => (
        <FormItem className="gap-1">
          <span id={labelId} className={fieldLabel}>
            Version
          </span>
          <FormControl>
            <EidolonVersionCards
              versions={versions}
              value={field.value}
              name={field.name}
              labelledBy={labelId}
              isDisabled={disabled}
              reasonId={reasonId}
              onValueChange={field.onChange}
              onBlur={field.onBlur}
            />
          </FormControl>
          <p className="text-muted-foreground text-xs">
            Your other choices are kept: the subtype and every evolution stay
            recorded under either version.
          </p>
        </FormItem>
      )}
    />
  );
}
