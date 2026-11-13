'use client';
import { ArrowRight } from 'lucide-react';
import { useId } from 'react';
import { cn } from '~/lib/utils';
import type { EidolonProgressionView } from './character-eidolon-progression-view-model';
import { fieldLabel } from './sheet-parts';

type Reduction = NonNullable<EidolonProgressionView['ordinary']['reduction']>;

/**
 * The operation trail of a reduced summoner level (#420), such as Master
 * Summoner's Lesser Eidolon: the actual summoner level, then each step in
 * order down to the level the eidolon table is read at. The steps wrap on
 * the phone; the arrows between them are decoration.
 */
export function EidolonLevelReduction({ reduction }: { reduction: Reduction }) {
  const labelId = useId();
  return (
    <div className="flex flex-col gap-1">
      <span id={labelId} className={fieldLabel}>
        {reduction.label}
      </span>
      <ol
        aria-labelledby={labelId}
        className="text-muted-foreground flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs"
      >
        {reduction.steps.map((step, index) => (
          <li key={step.label} className="flex items-baseline gap-x-2">
            {index > 0 ? (
              <ArrowRight aria-hidden className="size-3 shrink-0 self-center" />
            ) : null}
            <span className="[overflow-wrap:anywhere]">{step.label}</span>
            <span
              className={cn(
                'font-mono text-sm tabular-nums',
                step.value !== null && 'text-foreground',
              )}
            >
              {step.value ?? 'Unresolved'}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
