'use client';
import { cn } from '~/lib/utils';
import { chip, fieldLabel } from './sheet-parts';

export type ArchetypeFeatureRow = {
  key: string;
  classLevel: number;
  name: string;
  /** Not yet reached by this class's levels. */
  isLater: boolean;
  /** How much of the feature is replaced; additions have no extent. */
  extent?: 'Whole feature' | 'Independent part';
};

const mutedChip = cn(chip, 'text-muted-foreground');

/**
 * What an Archetype replaces or adds, by class level. Rows the class has
 * not reached yet stay listed and say so in words, so the schedule reads
 * complete without implying it is gained.
 */
export function ArchetypeFeatureList({
  title,
  rows,
  emptyText,
}: {
  title: 'Replaces' | 'Adds';
  rows: ArchetypeFeatureRow[];
  emptyText: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <p className={fieldLabel}>{title}</p>
      {rows.length === 0 ? (
        <p className="text-muted-foreground text-xs">{emptyText}</p>
      ) : (
        <ul aria-label={title} className="flex flex-col gap-0.5">
          {rows.map((row) => (
            <li
              key={row.key}
              className={cn(
                'flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm',
                row.isLater && 'text-muted-foreground',
              )}
            >
              <span className="text-muted-foreground w-14 shrink-0 font-mono text-xs">
                Level {row.classLevel}
              </span>
              <span className="min-w-0 [overflow-wrap:anywhere]">
                {row.name}
              </span>
              {row.extent ? (
                <span className={mutedChip}>{row.extent}</span>
              ) : null}
              {row.isLater ? (
                <span className={mutedChip}>Later level</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
