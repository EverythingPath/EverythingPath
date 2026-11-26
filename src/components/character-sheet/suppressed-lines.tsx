'use client';
import type {
  ResolvedStatistic,
  SuppressedModifier,
} from '~/lib/character-sheet';
import { BreakdownLine, contributionKey } from './breakdown-line';
import { findSuppressorName } from './stat-breakdown-groups';

/**
 * Contributions stacking set aside, struck through, with why and by what; a
 * reason that already names what set it aside (an armor limit's reason names
 * the armor, which may also reduce the statistic) says so itself, and the
 * entry is not named again.
 */
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
        detail={
          winner && !item.reasonNamesSuppressor
            ? `${item.reason} (${winner})`
            : item.reason
        }
      />
    );
  });
}
