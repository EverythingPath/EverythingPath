'use client';
import type {
  ResolvedStatistic,
  SuppressedModifier,
} from '~/lib/character-sheet';
import { BreakdownLine, contributionKey } from './breakdown-line';
import { findSuppressorName } from './stat-breakdown-groups';

/** Contributions stacking set aside, struck through, with why and by what. */
export function SuppressedLines({
  items,
  statistic,
  format,
}: {
  items: SuppressedModifier[];
  statistic: ResolvedStatistic;
  format?: (value: number) => string;
}) {
  return items.map((item, index) => {
    const winner = findSuppressorName(item, statistic);
    return (
      <BreakdownLine
        key={contributionKey(item, index)}
        contribution={item}
        isStruck
        className="text-muted-foreground"
        format={format}
        detail={winner ? `${item.reason} (${winner})` : item.reason}
      />
    );
  });
}
