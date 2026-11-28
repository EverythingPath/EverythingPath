'use client';
import { Check } from 'lucide-react';
import { useId } from 'react';
import { cn } from '~/lib/utils';
import type { SaveStatus } from './save-status';
import { SaveFeedback } from './sheet-parts';

const note = 'text-muted-foreground text-xs [overflow-wrap:anywhere]';
const switchButton =
  'inline-flex min-h-11 items-center gap-1.5 border px-2 text-left font-mono text-xs disabled:opacity-50 md:min-h-7';

/**
 * Keep: whether the recorded choices go on counting while no supporting
 * source counts. One switch for the animal companion
 * (#325) and the eidolon (#409); each writes its whole recorded state with
 * only Keep changed.
 */
export function CompanionProgressionKeepSwitch({
  isKept,
  isDisabled,
  reasonId,
  status,
  note: noteText,
  onToggle,
}: {
  isKept: boolean;
  isDisabled: boolean;
  /** The maintenance reason that describes the disabled control. */
  reasonId: string | undefined;
  status: SaveStatus;
  /** What goes on counting, in words. */
  note: string;
  onToggle: () => void;
}) {
  const noteId = useId();
  return (
    <div className="flex flex-col gap-1">
      <div>
        <button
          type="button"
          role="switch"
          aria-checked={isKept}
          aria-describedby={[noteId, reasonId].filter(Boolean).join(' ')}
          disabled={isDisabled}
          onClick={onToggle}
          className={cn(
            switchButton,
            isKept
              ? 'border-primary'
              : 'border-foreground/40 text-muted-foreground',
          )}
        >
          <Check
            aria-hidden
            className={cn('size-3.5', !isKept && 'invisible')}
          />
          Keep recorded choices counting
        </button>
      </div>
      <p id={noteId} className={note}>
        {noteText}
      </p>
      <SaveFeedback
        status={status}
        savedText="Saved"
        savingText="Saving…"
        shouldHideWhenIdle
      />
    </div>
  );
}
