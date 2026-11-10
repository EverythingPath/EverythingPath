import { cn } from '~/lib/utils';
import { chip } from './sheet-parts';
import type { SelectionRowView } from './selection-view-types';

type Status = SelectionRowView['currentStatus'];

const statusText: Record<Exclude<Status, null | 'none'>, string> = {
  met: 'Prerequisites met',
  unmet: 'Prerequisites not met',
  exempt: 'Prerequisites waived',
};

/**
 * The checked prerequisites in a word: met, not met (amber, advisory), or
 * waived for a Grant or an exempt slot. A feat without checkable
 * prerequisites, or with only prose the sheet cannot check, shows nothing.
 */
export function PrerequisiteStatusChip({
  status,
  className,
}: {
  status: Status;
  className?: string;
}) {
  if (status === null || status === 'none') return null;
  return (
    <span
      className={cn(
        chip,
        status === 'unmet'
          ? 'border-amber-300/60 text-amber-300'
          : 'text-muted-foreground',
        className,
      )}
    >
      {statusText[status]}
    </span>
  );
}

/** The catalog's own prerequisite wording, readable whether or not it is checked. */
export function PrerequisiteProse({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  if (!text.trim()) return null;
  return (
    <p
      className={cn(
        'text-muted-foreground text-xs [overflow-wrap:anywhere]',
        className,
      )}
    >
      Prerequisites: {text}
    </p>
  );
}
