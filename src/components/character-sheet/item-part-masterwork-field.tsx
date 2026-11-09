'use client';
import type { ReactNode } from 'react';
import { Checkbox } from '~/components/ui/checkbox';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '~/components/ui/form';
import { fieldLabel } from './sheet-parts';
import type { useAttackWeaponEndForm } from './use-attack-routine-form';

type Editor = ReturnType<typeof useAttackWeaponEndForm>;

const hint = 'text-muted-foreground text-xs';

/**
 * An item part's masterwork toggle, saved as it changes. A part that is
 * masterwork anyway, through its enhancement or material, states so instead.
 */
export function ItemPartMasterworkField({
  editor,
  isReadOnly,
  describedBy,
  isImplied,
  feedback,
}: {
  editor: Editor;
  isReadOnly: boolean;
  describedBy?: string;
  isImplied: boolean;
  feedback: ReactNode;
}) {
  if (isImplied)
    return (
      <div className="flex flex-col gap-1">
        <span aria-hidden className={fieldLabel}>
          &nbsp;
        </span>
        <span className="inline-flex min-h-11 flex-wrap items-center gap-x-1 font-mono text-sm md:min-h-8">
          Masterwork{' '}
          <span className={hint}>(from its enhancement or material)</span>
        </span>
      </div>
    );
  return (
    <FormField
      control={editor.form.control}
      name="masterwork"
      render={({ field }) => (
        <FormItem className="gap-1">
          <span aria-hidden className={fieldLabel}>
            &nbsp;
          </span>
          <FormLabel className="min-h-11 cursor-pointer gap-2 font-mono text-sm font-normal md:min-h-8">
            <FormControl aria-describedby={describedBy}>
              <Checkbox
                name={field.name}
                ref={field.ref}
                checked={field.value}
                disabled={isReadOnly}
                onBlur={field.onBlur}
                onCheckedChange={(checked) =>
                  void editor.change('masterwork', checked)
                }
              />
            </FormControl>
            <span>Masterwork</span>
          </FormLabel>
          {feedback}
        </FormItem>
      )}
    />
  );
}
