'use client';
import { useId, useState } from 'react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { action, fieldLabel } from './sheet-parts';

/**
 * The recorded choice for a feat, trait or other choice-bearing Selection,
 * e.g. the weapon for Weapon Focus. Optional; the typed text survives a
 * refused add so it can be retried.
 */
export function CatalogChoiceForm({
  name,
  isDisabled,
  onSubmit,
  onCancel,
}: {
  name: string;
  isDisabled: boolean;
  onSubmit: (choice: string | undefined) => void;
  onCancel: () => void;
}) {
  const [choice, setChoice] = useState('');
  const choiceId = useId();
  const hintId = useId();
  return (
    <form
      noValidate
      aria-label={`Add ${name}`}
      className="border-foreground/20 mt-1 flex flex-wrap items-end gap-x-3 gap-y-2 border p-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (isDisabled) return;
        onSubmit(choice.trim() || undefined);
      }}
    >
      <div className="flex min-w-0 flex-1 basis-48 flex-col gap-1">
        <label htmlFor={choiceId} className={fieldLabel}>
          Choice
        </label>
        <Input
          id={choiceId}
          type="text"
          autoComplete="off"
          value={choice}
          disabled={isDisabled}
          aria-describedby={hintId}
          className="h-11 md:h-8"
          onChange={(event) => setChoice(event.target.value)}
        />
        <p id={hintId} className="text-muted-foreground text-xs">
          Optional. Recorded with this selection.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Button
          type="submit"
          size="sm"
          className={action}
          disabled={isDisabled}
        >
          Add <span className="sr-only">{name}</span>
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className={action}
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
