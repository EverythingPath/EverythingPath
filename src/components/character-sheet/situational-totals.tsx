'use client';
import type { ReactNode } from 'react';
import type { ResolvedStatistic } from '~/lib/character-sheet';
import { cn } from '~/lib/utils';
import { useBreakdownResolver } from './breakdown-resolver';
import { describeSituationChoice } from './situation-copy';
import { SituationExplanation } from './situation-explanation';
import type { BreakdownTarget } from './stat-breakdown-content';
import { StatBreakdown } from './stat-breakdown';
import { useSituationBreakdown } from './use-situation-breakdown';

type Alternate = {
  key: string;
  /** The circumstance in words, beside the number and in its name. */
  circumstance: string;
  isSelected: boolean;
  statistic: ResolvedStatistic;
  explanation: ReactNode;
};

/**
 * A number's alternate totals, beside it (approved prototype's variant 2):
 * first what the picked Situations make it together, then one per other
 * Situation that changes it, each labelled with its circumstance and
 * opening its own explanation. The normal number stays as it is beside
 * them; nothing is added to it. Combat situations, notes-only Situations
 * and ones whose preview is unavailable show no alternate here.
 */
export function SituationalTotals({
  label,
  statistic,
  target,
  format = String,
  formatContribution,
  lead,
  incompleteReason = null,
  isStacked = false,
  className,
}: {
  /** The number's own label; each alternate's name adds its circumstance. */
  label: string;
  statistic: ResolvedStatistic;
  target: BreakdownTarget;
  format?: (total: number) => string;
  formatContribution?: (value: number) => string;
  lead?: ReactNode;
  incompleteReason?: string | null;
  /** One alternate per line, as in a narrow table cell. */
  isStacked?: boolean;
  className?: string;
}) {
  const resolver = useBreakdownResolver();
  const view = useSituationBreakdown(statistic, target);
  if (!view) return null;
  const selectedKeys = new Set(resolver.selected.selectedKeys);
  const alternates: Alternate[] = [];
  if (view.selected?.changed)
    alternates.push({
      key: 'selected',
      circumstance: `selected: ${resolver.selected.text}`,
      isSelected: true,
      statistic: view.selected.statistic,
      explanation: (
        <SituationExplanation
          statistic={view.selected.statistic}
          waiting={view.selected.waiting}
          notes={view.selected.notes}
          formatContribution={formatContribution}
        />
      ),
    });
  for (const group of view.groups) {
    if (!group.statistic || group.change?.total == null) continue;
    if (selectedKeys.has(group.key)) continue;
    alternates.push({
      key: group.key,
      circumstance: describeSituationChoice(
        group,
        resolver.findPrerequisiteName,
      ),
      isSelected: false,
      statistic: group.statistic,
      explanation: (
        <SituationExplanation
          statistic={group.statistic}
          waiting={group.change.waiting}
          notes={[...view.notes, ...group.notes]}
          formatContribution={formatContribution}
        />
      ),
    });
  }
  if (alternates.length === 0) return null;
  return (
    <span
      className={cn(
        'flex-wrap items-baseline gap-x-2 gap-y-0.5',
        isStacked ? 'flex flex-col items-end' : 'inline-flex justify-end',
        className,
      )}
    >
      {alternates.map((alternate) => (
        <span
          key={alternate.key}
          className={cn(
            'inline-flex max-w-full items-baseline gap-1',
            alternate.isSelected && 'bg-sky-400/15 pr-1',
          )}
        >
          <StatBreakdown
            label={`${label}, ${alternate.circumstance}`}
            statistic={alternate.statistic}
            format={format}
            formatContribution={formatContribution}
            lead={lead}
            incompleteReason={incompleteReason}
            explanation={alternate.explanation}
            tone="situation"
            className="min-h-7 text-sm"
          />
          <span
            aria-hidden
            className="min-w-0 text-xs [overflow-wrap:anywhere] text-sky-300/80"
          >
            {alternate.isSelected ? (
              <span className="font-mono tracking-wide uppercase">
                Selected{' '}
              </span>
            ) : null}
            {alternate.isSelected
              ? resolver.selected.text
              : alternate.circumstance}
          </span>
        </span>
      ))}
    </span>
  );
}
