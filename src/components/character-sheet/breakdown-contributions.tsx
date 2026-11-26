'use client';
import type { ResolvedStatistic } from '~/lib/character-sheet';
import { cn } from '~/lib/utils';
import { BreakdownLine, contributionKey } from './breakdown-line';
import { useBreakdownResolver } from './breakdown-resolver';
import { fieldLabel } from './sheet-parts';
import { describeCastingScope } from './stat-breakdown-groups';
import { SuppressedLines } from './suppressed-lines';

/**
 * Every contribution that applies, built-ins included, then what stacking
 * set aside and why. Nothing here is summed by hand.
 */
export function BreakdownContributions({
  statistic,
  formatContribution,
}: {
  statistic: ResolvedStatistic;
  formatContribution?: (value: number) => string;
}) {
  const resolver = useBreakdownResolver();
  return (
    <>
      {statistic.applied.length === 0 ? (
        <p className="text-muted-foreground text-xs">Nothing applies yet.</p>
      ) : (
        <ul className="space-y-0.5">
          {statistic.applied.map((item, index) => (
            <BreakdownLine
              key={contributionKey(item, index)}
              contribution={item}
              detail={describeCastingScope(item, resolver.findCastingClassName)}
              format={formatContribution}
            />
          ))}
        </ul>
      )}
      {statistic.suppressed.length > 0 ? (
        <>
          <p className={cn(fieldLabel, 'mt-2')}>Not applied</p>
          <ul className="space-y-0.5">
            <SuppressedLines
              items={statistic.suppressed}
              statistic={statistic}
              format={formatContribution}
            />
          </ul>
        </>
      ) : null}
    </>
  );
}
