'use client';
import { useId, useState } from 'react';
import { cn } from '~/lib/utils';
import { CombinedFormMessages } from './combined-form-messages';
import type { CompanionsController } from './companion-props';
import { keyedByOccurrence } from './keyed-by-occurrence';
import {
  action,
  chip,
  noteText,
  StatisticCell,
  StatisticValue,
} from './sheet-parts';

type CombinedFormView = NonNullable<
  CompanionsController['combinedForm']['view']
>;
type Statistic = CombinedFormView['statistics'][number];

/**
 * One fused statistic of the Combined Form (#421) as a summary cell: a
 * group named by the statistic, its value as the view words it (Unresolved
 * muted and small, never a number in its place) and the note beneath.
 * A value with contributions is a disclosure button named
 * "<label> <value>, breakdown" that opens them in place, each line with the
 * build it comes from; the lines are already applied values and are never
 * summed here. A message about the value sits beside it, informational.
 */
export function CombinedFormStatistic({ statistic }: { statistic: Statistic }) {
  const panelId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const { label, value, contributions } = statistic;
  const hasBreakdown = contributions.length > 0;
  return (
    <StatisticCell label={label}>
      {hasBreakdown ? (
        <button
          type="button"
          aria-label={`${label} ${value}, breakdown`}
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            action,
            'hover:bg-foreground/10 focus-visible:ring-ring/50 inline-flex items-center self-start border-b border-dotted px-1 outline-none focus-visible:ring-[3px]',
            isOpen ? 'border-primary bg-foreground/10' : 'border-foreground/40',
          )}
        >
          <StatisticValue value={value} />
        </button>
      ) : (
        <span
          className={cn(action, 'inline-flex items-center self-start px-1')}
        >
          <StatisticValue value={value} />
        </span>
      )}
      {statistic.note ? (
        <span className={noteText}>{statistic.note}</span>
      ) : null}
      <CombinedFormMessages messages={statistic.messages} />
      {hasBreakdown ? (
        <div id={panelId}>
          {isOpen ? (
            <ul
              aria-label={`${label} breakdown`}
              className="space-y-0.5 text-xs"
            >
              {keyedByOccurrence(
                contributions,
                (line) => `${line.label}|${line.source}|${line.value}`,
              ).map(({ key, item: line }) => (
                <li key={key} className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                    {line.label}
                  </span>
                  <span className={cn(chip, 'text-muted-foreground')}>
                    {line.source}
                  </span>
                  <span className="font-mono tabular-nums">{line.value}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </StatisticCell>
  );
}
