'use client';
import { Button } from '~/components/ui/button';
import type { SaveStatus } from './save-status';
import { SaveFeedback } from './sheet-parts';

/** A field's own save: Saving…, Saved, or the refusal with Try again. */
export function AttackFieldFeedback({
  status,
  label,
  onRetry,
  isDisabled,
}: {
  status: SaveStatus;
  /** Completes "Try again saving …" for the screen reader. */
  label: string;
  onRetry: () => void;
  isDisabled: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <SaveFeedback
        status={status}
        savedText="Saved"
        savingText="Saving…"
        shouldHideWhenIdle
      />
      {status.kind === 'error' ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-11 px-2 text-xs md:h-7"
          disabled={isDisabled}
          onClick={onRetry}
        >
          Try again <span className="sr-only">saving {label}</span>
        </Button>
      ) : null}
    </div>
  );
}
