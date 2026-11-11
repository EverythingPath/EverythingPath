'use client';
import { ChevronRight } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import type { EidolonProgressionView } from './character-eidolon-progression-view-model';
import { InlineDeleteQuestion } from './inline-delete-question';
import type { SaveStatus } from './save-status';
import { action, chip, SaveFeedback } from './sheet-parts';

export type DormantChoice =
  EidolonProgressionView['ordinary']['dormantChoices'][number];

const mutedChip = cn(chip, 'text-muted-foreground');

function dormantTitle(entry: DormantChoice) {
  return entry.choice ? `${entry.label}: ${entry.choice}` : entry.label;
}

function DormantRow({
  entry,
  isBusy,
  onDiscard,
}: {
  entry: DormantChoice;
  isBusy: boolean;
  onDiscard: () => Promise<boolean>;
}) {
  const [isAsking, setIsAsking] = useState(false);
  const discardButton = useRef<HTMLButtonElement>(null);
  const title = dormantTitle(entry);
  function close() {
    setIsAsking(false);
    discardButton.current?.focus();
  }
  return (
    <li aria-label={title} className="flex flex-col gap-1 py-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="text-muted-foreground min-w-0 text-sm [overflow-wrap:anywhere]">
          {title}
        </span>
        <span className={mutedChip}>{entry.reasonLabel}</span>
        <Button
          ref={discardButton}
          type="button"
          size="sm"
          variant="ghost"
          className={cn(action, 'text-muted-foreground ml-auto px-2 text-xs')}
          aria-pressed={isAsking}
          onClick={() => setIsAsking(!isAsking)}
        >
          Discard <span className="sr-only">{title}</span>
        </Button>
      </div>
      {isAsking ? (
        <InlineDeleteQuestion
          question={`Discard ${title}?`}
          details="The current rules cannot apply it. Discarding takes it off the record; nothing else changes."
          subject={title}
          deleteLabel="Discard"
          keepLabel="Cancel"
          isBusy={isBusy}
          onDelete={() => {
            void onDiscard().then((isDiscarded) => {
              if (isDiscarded) close();
            });
          }}
          onKeep={close}
        />
      ) : null}
    </li>
  );
}

/**
 * Recorded Unchained subtype state the current rules do not apply: the
 * subtype itself on an original eidolon, or a former subtype's choices.
 * Collapsed under its count, as lost Grants are; only the player opens it.
 * Each entry reads as recorded with why it does not count. Discard, asked
 * in place, writes the whole record without that entry; there is no Keep,
 * because the other rules cannot apply it. The question's own answers
 * carry the maintenance reason; the toggle that asks it stays usable.
 */
export function EidolonDormantChoices({
  entries,
  status,
  onDiscard,
}: {
  entries: readonly DormantChoice[];
  status: SaveStatus;
  onDiscard: (entry: DormantChoice) => Promise<boolean>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();
  if (entries.length === 0) return null;
  const label = `Not counting now (${entries.length})`;
  return (
    <div className="border-foreground/10 border-t pt-2">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          action,
          'text-muted-foreground hover:text-foreground inline-flex items-center gap-1 font-mono text-xs',
        )}
      >
        <ChevronRight
          aria-hidden
          className={cn('size-3.5 transition-transform', isOpen && 'rotate-90')}
        />
        {label}
      </button>
      <div id={panelId}>
        {isOpen ? (
          <>
            <ul aria-label={label} className="divide-foreground/10 divide-y">
              {entries.map((entry) => (
                <DormantRow
                  key={`${entry.kind}/${entry.key}`}
                  entry={entry}
                  isBusy={status.kind === 'saving'}
                  onDiscard={() => onDiscard(entry)}
                />
              ))}
            </ul>
            <SaveFeedback
              status={status}
              savedText="Saved"
              savingText="Saving…"
              shouldHideWhenIdle
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
