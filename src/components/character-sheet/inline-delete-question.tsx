'use client';
import { useId, useRef, type ReactNode } from 'react';
import {
  MaintenanceReason,
  useMaintenanceReasonId,
} from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';

const answerButton = 'h-11 md:h-8';

/**
 * A deletion asked in place (approved prototype) where a trash control
 * stood: the question, what it would remove, Delete and Keep, then
 * maintenance and anything the caller reports beside them. Focus lands on
 * Keep, the harmless answer, and returns there when Delete is sent, so it
 * never rests on a disabled button. Escape answers Keep. The caller owns
 * the write and what follows it.
 */
export function InlineDeleteQuestion({
  question,
  details,
  subject,
  deleteLabel = 'Delete',
  keepLabel = 'Keep',
  isBusy,
  isKeepDisabled = false,
  className,
  onDelete,
  onKeep,
  children,
}: {
  question: string;
  /** What the answer removes, read with the question. */
  details?: ReactNode;
  /** Read out after each answer, so "Delete" and "Keep" name their target. */
  subject: string;
  /** The destructive answer's verb, when "Delete" is not the word. */
  deleteLabel?:
    | 'Delete'
    | 'Remove'
    | 'Discard'
    | 'Discard saved state'
    | 'Interrupt relationship';
  /** The harmless answer, when "Keep" already means something else here. */
  keepLabel?: string;
  /** Another write is pending: Delete waits for it. */
  isBusy: boolean;
  isKeepDisabled?: boolean;
  className?: string;
  onDelete: () => void;
  onKeep: () => void;
  children?: ReactNode;
}) {
  const maintenance = useInitialMigrationMaintenance();
  const reasonId = useMaintenanceReasonId(maintenance);
  const questionId = useId();
  const detailsId = useId();
  const keep = useRef<HTMLButtonElement>(null);
  return (
    <div
      role="group"
      aria-labelledby={questionId}
      aria-describedby={details ? detailsId : undefined}
      className={cn(
        'flex flex-wrap items-center gap-x-1 gap-y-1 text-xs',
        className,
      )}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();
        onKeep();
      }}
    >
      <p id={questionId} className="px-1">
        {question}
      </p>
      {details ? (
        <div id={detailsId} className="w-full px-1">
          {details}
        </div>
      ) : null}
      <Button
        type="button"
        size="sm"
        variant="destructive"
        className={answerButton}
        aria-describedby={reasonId}
        disabled={isBusy || maintenance.readOnly}
        onClick={() => {
          if (maintenance.readOnly) return;
          keep.current?.focus();
          onDelete();
        }}
      >
        {deleteLabel} <span className="sr-only">{subject}</span>
      </Button>
      <Button
        ref={keep}
        type="button"
        size="sm"
        variant="ghost"
        className={answerButton}
        autoFocus
        disabled={isKeepDisabled}
        onClick={onKeep}
      >
        {keepLabel} <span className="sr-only">{subject}</span>
      </Button>
      <MaintenanceReason notice={maintenance} />
      {children}
    </div>
  );
}
