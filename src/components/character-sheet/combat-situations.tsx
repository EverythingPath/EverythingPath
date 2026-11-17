'use client';
import { ChevronRight } from 'lucide-react';
import { useId, useState } from 'react';
import { cn } from '~/lib/utils';
import { fieldLabel } from './sheet-parts';
import { SituationPreview } from './situation-preview';
import type { SituationBreakdownGroup } from './use-situation-breakdown';

/**
 * The built-in Combat situations a number has (charging, fighting
 * defensively…), collapsed under the other Situations: every number has
 * them in a fight, so they earn no marker and stay out of the way until
 * asked for.
 */
export function CombatSituations({
  groups,
  format,
  formatContribution,
}: {
  groups: readonly SituationBreakdownGroup[];
  format: (total: number) => string;
  formatContribution?: (value: number) => string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const listId = useId();
  if (groups.length === 0) return null;
  return (
    <div className="border-foreground/15 mt-2 border-t pt-1">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={listId}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          fieldLabel,
          'hover:text-foreground focus-visible:ring-ring/50 -mx-1 flex min-h-8 w-full items-center gap-1 px-1 text-left outline-none focus-visible:ring-[3px]',
        )}
      >
        <ChevronRight
          aria-hidden
          className={cn('size-3.5 transition-transform', isOpen && 'rotate-90')}
        />
        Combat situations
      </button>
      <ul id={listId} hidden={!isOpen} className="space-y-2 pt-1">
        {groups.map((group) => (
          <SituationPreview
            key={group.key}
            group={group}
            format={format}
            formatContribution={formatContribution}
          />
        ))}
      </ul>
    </div>
  );
}
