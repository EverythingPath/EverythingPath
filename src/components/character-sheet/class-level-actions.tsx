'use client';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import { InlineDeleteQuestion } from './inline-delete-question';

const rowButton = 'size-11 md:size-8';

/**
 * A level's own structural actions, named by its current position: insert a
 * level before it, move it, delete it. Moves are disabled only at the ends
 * of the list; everything waits while another structural change is pending.
 * The trash asks first, in place.
 */
export function ClassLevelActions({
  level,
  className,
  headingId,
  isFirst,
  isLast,
  isBusy,
  cellClassName,
  onInsertBefore,
  onMove,
  onDelete,
}: {
  level: number;
  /** The class as the row shows it, for the deletion question. */
  className: string;
  headingId: string;
  isFirst: boolean;
  isLast: boolean;
  isBusy: boolean;
  cellClassName: string;
  onInsertBefore: () => void;
  onMove: (position: number) => void;
  onDelete: () => void;
}) {
  const maintenance = useInitialMigrationMaintenance();
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const deleteTrigger = useRef<HTMLButtonElement>(null);
  const isDisabled = isBusy || maintenance.readOnly;
  if (isConfirmingDelete)
    return (
      <InlineDeleteQuestion
        question={`Delete ${className} (level ${level})?`}
        subject={`level ${level}`}
        isBusy={isBusy}
        className={cellClassName}
        onDelete={onDelete}
        onKeep={() => {
          flushSync(() => setIsConfirmingDelete(false));
          const trigger = deleteTrigger.current;
          if (trigger && !trigger.disabled) trigger.focus();
          else document.getElementById(headingId)?.focus();
        }}
      />
    );
  return (
    <div className={cellClassName}>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className={rowButton}
        aria-label={`Insert level before level ${level}`}
        disabled={isDisabled}
        onClick={() => {
          if (maintenance.readOnly) return;
          onInsertBefore();
        }}
      >
        <Plus />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className={rowButton}
        aria-label={`Move level ${level} up`}
        disabled={isFirst || isDisabled}
        onClick={() => {
          if (maintenance.readOnly) return;
          onMove(level - 1);
        }}
      >
        <ArrowUp />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className={rowButton}
        aria-label={`Move level ${level} down`}
        disabled={isLast || isDisabled}
        onClick={() => {
          if (maintenance.readOnly) return;
          onMove(level + 1);
        }}
      >
        <ArrowDown />
      </Button>
      <Button
        ref={deleteTrigger}
        type="button"
        size="icon"
        variant="ghost"
        data-delete-level
        className={cn(
          rowButton,
          'text-muted-foreground hover:text-destructive',
        )}
        aria-label={`Delete level ${level}`}
        disabled={isDisabled}
        onClick={() => {
          if (maintenance.readOnly) return;
          setIsConfirmingDelete(true);
        }}
      >
        <Trash2 />
      </Button>
    </div>
  );
}
