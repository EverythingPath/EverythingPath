'use client';
import { Button } from '~/components/ui/button';
import { action } from './sheet-parts';

/**
 * Opens or closes the progression editor; pressed while it is open. The
 * same control sets up a Companion without a species and edits recorded
 * choices, named for whichever it does.
 */
export function CompanionProgressionEditorToggle({
  label,
  isEditorOpen,
  isDisabled,
  reasonId,
  onToggle,
}: {
  label: string;
  isEditorOpen: boolean;
  isDisabled: boolean;
  /** The maintenance reason that describes the disabled control. */
  reasonId: string | undefined;
  onToggle: (opener: HTMLElement) => void;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className={action}
      aria-pressed={isEditorOpen}
      aria-describedby={reasonId}
      disabled={isDisabled}
      onClick={(event) => onToggle(event.currentTarget)}
    >
      {label}
    </Button>
  );
}
