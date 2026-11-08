'use client';
import { cn } from '~/lib/utils';
import type { CompanionRelationshipView } from './character-companions-view-model';
import { CompanionName } from './companion-name';
import { chip, fieldLabel } from './sheet-parts';

const mutedChip = cn(chip, 'text-muted-foreground');

/**
 * One relationship in words, shared by the sheet's Companions section and
 * the Characters lists: which side of it this Character is on, the other
 * Character's name, its kind and whether it is active. An inaccessible
 * endpoint reads only as unavailable, with no link, name or detail.
 */
export function CompanionRelationshipSummary({
  row,
  className,
}: {
  row: CompanionRelationshipView;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-0.5', className)}>
      <span className={fieldLabel}>{row.roleLabel}</span>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <CompanionName row={row} />
        <span className={chip}>{row.kindLabel}</span>
        <span className={row.status === 'active' ? chip : mutedChip}>
          {row.statusLabel}
        </span>
      </div>
    </div>
  );
}
