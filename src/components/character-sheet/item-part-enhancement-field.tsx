'use client';
import { Minus, Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '~/components/ui/button';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '~/components/ui/form';
import { Input } from '~/components/ui/input';
import { cn } from '~/lib/utils';
import { fieldLabel } from './sheet-parts';
import type { useAttackWeaponEndForm } from './use-attack-routine-form';

type Editor = ReturnType<typeof useAttackWeaponEndForm>;
const control = 'h-11 md:h-8';

/**
 * An item part's enhancement, saved as it is typed, with Decrease and
 * Increase beside it where the part has room; a malformed value stays local
 * with its error.
 */
export function ItemPartEnhancementField({
  editor,
  fieldId,
  isReadOnly,
  describedBy,
  hasStepper,
  feedback,
}: {
  editor: Editor;
  /** Prefixes the field's own error ID. */
  fieldId: string;
  isReadOnly: boolean;
  describedBy?: string;
  hasStepper: boolean;
  feedback: ReactNode;
}) {
  const { form } = editor;
  function step(delta: number) {
    if (isReadOnly) return;
    const current = Number(form.getValues('enhancement'));
    const next = Number.isSafeInteger(current)
      ? Math.max(0, current + delta)
      : 0;
    void editor.change('enhancement', String(next));
  }
  return (
    <FormField
      control={form.control}
      name="enhancement"
      render={({ field, fieldState }) => (
        <FormItem className={cn('gap-1', hasStepper ? 'w-44' : 'w-28')}>
          <FormLabel className={fieldLabel}>Enhancement</FormLabel>
          <div className="flex items-center gap-1">
            {hasStepper ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-11 shrink-0 rounded-none md:size-8"
                disabled={isReadOnly || Number(field.value) <= 0}
                aria-describedby={describedBy}
                onClick={() => step(-1)}
              >
                <Minus aria-hidden className="size-4" />
                <span className="sr-only">Decrease enhancement</span>
              </Button>
            ) : null}
            <FormControl
              aria-describedby={cn(
                describedBy,
                fieldState.error && `${fieldId}-enhancement-error`,
              )}
            >
              <Input
                {...field}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                disabled={isReadOnly}
                className={cn(control, 'w-20 text-center font-mono')}
                onChange={(event) =>
                  void editor.change('enhancement', event.target.value)
                }
              />
            </FormControl>
            {hasStepper ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-11 shrink-0 rounded-none md:size-8"
                disabled={isReadOnly}
                aria-describedby={describedBy}
                onClick={() => step(1)}
              >
                <Plus aria-hidden className="size-4" />
                <span className="sr-only">Increase enhancement</span>
              </Button>
            ) : null}
          </div>
          <FormMessage
            id={`${fieldId}-enhancement-error`}
            role={fieldState.error ? 'alert' : undefined}
            className={fieldState.error ? undefined : 'hidden'}
          />
          {feedback}
        </FormItem>
      )}
    />
  );
}
