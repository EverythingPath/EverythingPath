'use client';
import { Check } from 'lucide-react';
import { cn } from '~/lib/utils';
import {
  describeReplacingArchetypes,
  formatCount,
} from './character-companion-allocations-view-model';
import type { CompanionRelationshipView } from './character-companions-view-model';
import type { CompanionsController } from './companion-props';
import { chip } from './sheet-parts';

const switchButton =
  'inline-flex min-h-11 items-center gap-1.5 border px-2 font-mono text-xs disabled:opacity-50 md:min-h-7';

/** A switched-on source that does not count: both labels, one condition. */
function notCounting(source: CompanionRelationshipView['sources'][number]) {
  if (!source.enabled || source.available) return null;
  return (
    <>
      <span className={cn(chip, 'text-muted-foreground')}>
        Not counting now
      </span>
      {source.notEntitled?.reason === 'replacedBy' ? (
        <span className={cn(chip, 'text-muted-foreground')}>
          {describeReplacingArchetypes(source.notEntitled.archetypes)}
        </span>
      ) : null}
    </>
  );
}

/**
 * Each Supporting Source as a switch; one that no longer counts says so,
 * and names the Archetypes that replaced its granting feature.
 */
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
          {notCounting(source)}
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
