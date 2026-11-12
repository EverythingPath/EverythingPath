import { TriangleAlert } from 'lucide-react';
import { cn } from '~/lib/utils';
import type { ReviewException, ReviewNote } from './review-facts';
import { obsoleteExceptionMessage } from './review-facts';
import {
  Chip,
  Quoted,
  warningText,
  wrap,
  type WeekReviewCapabilities,
} from './review-parts';

function Warning({ message }: { message: string }) {
  return (
    <p className={cn('flex gap-2 text-sm', warningText)}>
      <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span className={wrap}>
        <span className="sr-only">Warning: </span>
        {message}
      </span>
    </p>
  );
}

function Exception({
  note,
  capabilities,
}: {
  note: ReviewException;
  capabilities?: WeekReviewCapabilities;
}) {
  return (
    <div
      className={cn(
        'min-w-0 space-y-2 border-l-2 py-1 pl-3',
        note.obsolete ? 'border-amber-500/60' : 'border-border',
      )}
    >
      <p className="flex flex-wrap items-center gap-2">
        <Chip className={warningText}>{note.rule}</Chip>
        <span className="text-muted-foreground text-xs">Rules Exception</span>
      </p>
      {note.obsolete ? (
        <>
          {note.reason && <Quoted text={note.reason} />}
          <p className={cn('text-sm', warningText, wrap)}>
            {obsoleteExceptionMessage(note.ruleId)}
          </p>
          {capabilities?.exception?.(note)}
        </>
      ) : capabilities?.exception ? (
        capabilities.exception(note)
      ) : note.reason ? (
        <Quoted text={note.reason} />
      ) : (
        <p className="text-muted-foreground text-sm">No reason recorded.</p>
      )}
    </div>
  );
}

export function Notes({
  notes,
  capabilities,
}: {
  notes: ReviewNote[];
  capabilities?: WeekReviewCapabilities;
}) {
  if (notes.length === 0) return null;
  return (
    <ul className="min-w-0 space-y-2">
      {notes.map((note) => (
        <li key={note.key} className="min-w-0">
          {note.kind === 'warning' ? (
            <Warning message={note.message} />
          ) : note.kind === 'exception' ? (
            <Exception note={note} capabilities={capabilities} />
          ) : (
            <div className="border-border border-l-2 py-1 pl-3">
              <Quoted label="Recorded outcome" text={note.text} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
