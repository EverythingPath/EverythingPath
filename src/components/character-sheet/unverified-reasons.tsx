'use client';
import { cn } from '~/lib/utils';
import { describeUnverified, type EntryLabel } from './entry-label';

/**
 * Why an entry is unverified, as text, or for a screen reader only when
 * `isShown` is false. Nothing for a verified or unlabelled entry.
 */
export function UnverifiedReasons({
  label,
  id,
  isShown,
  className,
}: {
  label: EntryLabel | undefined;
  id: string;
  isShown: boolean;
  className?: string;
}) {
  if (label?.state !== 'unverified') return null;
  return (
    <span
      id={id}
      className={
        isShown
          ? cn(
              'text-muted-foreground min-w-0 text-xs [overflow-wrap:anywhere]',
              className,
            )
          : 'sr-only'
      }
    >
      {describeUnverified(label.reasons)}
    </span>
  );
}
