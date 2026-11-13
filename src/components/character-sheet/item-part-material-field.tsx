'use client';
import type { ReactNode } from 'react';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '~/components/ui/form';
import { Input } from '~/components/ui/input';
import { cn } from '~/lib/utils';
import { MaterialSelect } from './material-select';
import { fieldLabel } from './sheet-parts';
import type { useAttackWeaponEndForm } from './use-attack-routine-form';

type Editor = ReturnType<typeof useAttackWeaponEndForm>;

export type MaterialMode =
  | { kind: 'text' }
  | { kind: 'select' }
  /** A specific item's own material: a fact, not a choice. */
  | { kind: 'fact'; text: string };

const control = 'h-11 md:h-8';

/**
 * An item part's material: free text, a select of the special materials
 * with Other…, or a specific item's own material stated as a fact. A
 * material over 64 characters stays local with its error.
 */
export function ItemPartMaterialField({
  editor,
  fieldId,
  isReadOnly,
  describedBy,
  material,
  feedback,
}: {
  editor: Editor;
  /** Prefixes the field's own error ID. */
  fieldId: string;
  isReadOnly: boolean;
  describedBy?: string;
  material: MaterialMode;
  feedback: ReactNode;
}) {
  if (material.kind === 'fact')
    return (
      <div className="flex min-w-0 flex-col gap-1">
        <span className={fieldLabel}>Material</span>
        <span className="inline-flex min-h-11 items-center text-sm md:min-h-8">
          {material.text}
        </span>
      </div>
    );
  return (
    <FormField
      control={editor.form.control}
      name="material"
      render={({ field, fieldState }) => (
        <FormItem className="min-w-0 flex-1 basis-36 gap-1">
          <FormLabel className={fieldLabel}>Material</FormLabel>
          {material.kind === 'select' ? (
            <MaterialSelect
              label="Material"
              value={field.value}
              isDisabled={isReadOnly}
              describedBy={describedBy}
              onChange={(next) => void editor.change('material', next)}
            />
          ) : (
            <FormControl
              aria-describedby={cn(
                describedBy,
                fieldState.error && `${fieldId}-material-error`,
              )}
            >
              <Input
                {...field}
                type="text"
                autoComplete="off"
                disabled={isReadOnly}
                className={cn(control, 'w-full')}
                onChange={(event) =>
                  void editor.change('material', event.target.value)
                }
              />
            </FormControl>
          )}
          <FormMessage
            id={`${fieldId}-material-error`}
            role={fieldState.error ? 'alert' : undefined}
            className={fieldState.error ? undefined : 'hidden'}
          />
          {feedback}
        </FormItem>
      )}
    />
  );
}
