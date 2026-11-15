'use client';
import { useEffect, useId, useRef } from 'react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { cn } from '~/lib/utils';
import { fieldLabel } from './sheet-parts';
import { useOffListSpellLevelForm } from './use-off-list-spell-level-form';

/**
 * The explicit level of a Spell recorded off its Spellcasting's list. A new
 * off-list Spell is recorded only once this holds a whole number; a recorded
 * one saves its new level onto the same Spell. Any whole level of 0 or more
 * saves (an unusual one earns a rules warning afterwards). The draft stays
 * after a failed save, with focus back in it, for another try.
 */
export function OffListSpellLevelField({
  spellName,
  level,
  save,
  isSaving,
  isReadOnly,
  shouldFocusOnOpen = false,
  className,
}: {
  spellName: string;
  level: number | null;
  save: (level: number) => Promise<boolean>;
  isSaving: boolean;
  isReadOnly: boolean;
  shouldFocusOnOpen?: boolean;
  className?: string;
}) {
  const {
    form,
    save: submit,
    error,
  } = useOffListSpellLevelForm({ level, save });
  const inputId = useId();
  const errorId = useId();
  const { ref: registerInput, ...levelField } = form.register('level');
  const input = useRef<HTMLInputElement | null>(null);
  // Opening the field from the record check hands it the focus.
  useEffect(() => {
    if (shouldFocusOnOpen) input.current?.focus();
  }, [shouldFocusOnOpen]);
  return (
    <form
      noValidate
      aria-label={`${spellName} level`}
      className={cn('flex flex-wrap items-center gap-x-2 gap-y-1', className)}
      onSubmit={(event) => {
        event.preventDefault();
        if (isSaving || isReadOnly) return;
        void submit().then((saved) => {
          if (!saved) input.current?.focus();
        });
      }}
    >
      <label htmlFor={inputId} className={fieldLabel}>
        Level <span className="sr-only">of {spellName}</span>
      </label>
      <Input
        id={inputId}
        {...levelField}
        ref={(element) => {
          registerInput(element);
          input.current = element;
        }}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        readOnly={isSaving || isReadOnly}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="h-10 w-16 text-center font-mono md:h-8"
      />
      <Button
        type="submit"
        size="sm"
        variant="outline"
        className="min-h-10 md:min-h-8"
        disabled={isSaving || isReadOnly}
      >
        {isSaving ? 'Saving…' : 'Save level'}{' '}
        <span className="sr-only">of {spellName}</span>
      </Button>
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="text-destructive w-full text-xs [overflow-wrap:anywhere]"
        >
          {error}
        </p>
      ) : null}
    </form>
  );
}
