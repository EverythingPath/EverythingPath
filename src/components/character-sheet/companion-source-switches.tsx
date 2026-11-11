'use client';
import { Check } from 'lucide-react';
import { cn } from '~/lib/utils';
import { formatCount } from './character-companion-allocations-view-model';
import type { CompanionRelationshipView } from './character-companions-view-model';
import type { CompanionsController } from './companion-props';
import { chip } from './sheet-parts';

const switchButton =
  'inline-flex min-h-11 items-center gap-1.5 border px-2 font-mono text-xs disabled:opacity-50 md:min-h-7';

/** Each Supporting Source as a switch; one that no longer counts says so. */
export function CompanionSourceSwitches({
  row,
  controller,
  isDisabled,
  reasonId,
}: {
  row: CompanionRelationshipView;
  controller: CompanionsController;
  isDisabled: boolean;
  reasonId: string | undefined;
}) {
  if (row.sources.length === 0) return null;
  return (
    <ul
      aria-label="Supporting sources"
      className="mt-1.5 flex flex-wrap gap-1.5"
    >
      {row.sources.map((source) => (
        <li key={source.key} className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            role="switch"
            aria-checked={source.enabled}
            aria-describedby={reasonId}
            disabled={isDisabled || !row.canManage}
            onClick={() =>
              void controller.setSourceEnabled(row, source.key, !source.enabled)
            }
            className={cn(
              switchButton,
              source.enabled
                ? 'border-primary'
                : 'border-foreground/40 text-muted-foreground',
            )}
          >
            <Check
              aria-hidden
              className={cn('size-3.5', !source.enabled && 'invisible')}
            />
            <span className="[overflow-wrap:anywhere]">{source.label}</span>
          </button>
          {source.enabled && !source.available ? (
            <span className={cn(chip, 'text-muted-foreground')}>
              Not counting now
            </span>
          ) : null}
          {source.allocatedLevels !== undefined ? (
            <span className={cn(chip, 'text-muted-foreground')}>
              {formatCount(source.allocatedLevels, 'level')}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
