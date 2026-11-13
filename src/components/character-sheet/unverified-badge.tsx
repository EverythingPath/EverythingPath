'use client';
import { useId } from 'react';
import { Badge } from '~/components/ui/badge';
import { cn } from '~/lib/utils';
import type { EntryLabel } from './entry-label';
import { UnverifiedReasons } from './unverified-reasons';

/**
 * "Unverified" beside an entry whose release labels it so, described by its
 * reasons. Beside a name the reasons are for a screen reader only; the
 * entry's Definition panel or staged detail shows them as text
 * (`showsReasons`), reached with the control that opens it. A verified
 * entry, and one with no label, shows nothing. A caller that places the
 * reasons itself (a picker card, whose button they also describe) renders
 * `UnverifiedReasons` with `descriptionId`, and the badge renders alone.
 */
export function UnverifiedBadge({
  label,
  descriptionId,
  showsReasons = false,
  className,
}: {
  label: EntryLabel | undefined;
  descriptionId?: string;
  showsReasons?: boolean;
  className?: string;
}) {
  const ownId = useId();
  if (label?.state !== 'unverified') return null;
  const badge = (
    <Badge
      variant="secondary"
      aria-describedby={descriptionId ?? ownId}
      className={cn('font-normal', className)}
    >
      Unverified
    </Badge>
  );
  if (descriptionId) return badge;
  if (!showsReasons)
    return (
      <>
        {badge}
        <UnverifiedReasons label={label} id={ownId} isShown={false} />
      </>
    );
  return (
    <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
      {badge}
      <UnverifiedReasons label={label} id={ownId} isShown />
    </div>
  );
}
