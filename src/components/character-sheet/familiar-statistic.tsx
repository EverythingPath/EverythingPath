'use client';
import { useId } from 'react';
import {
  fieldLabel,
  noteText,
  StatisticCell,
  StatisticValue,
} from './sheet-parts';
import type { useCharacterSheet } from './use-character-sheet';

type FamiliarView = NonNullable<
  ReturnType<typeof useCharacterSheet>['familiar']['view']
>;
type Statistic = FamiliarView['statistics'][number];

/**
 * One familiar rule value as a summary cell: its name, the current value
 * (Unresolved rather than a partial number), the permanent value beside it
 * while a temporary effect changes it, and what it means. The cell is a
 * group named by the statistic and described by its meaning.
 */
export function FamiliarStatistic({ statistic }: { statistic: Statistic }) {
  const descriptionId = useId();
  return (
    <StatisticCell label={statistic.label} describedBy={descriptionId}>
      {statistic.hasTemporaryChange ? (
        <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="flex items-baseline gap-1">
            <span className={fieldLabel}>Current</span>
            <StatisticValue value={statistic.valueLabel} />
          </span>
          <span className="text-muted-foreground flex items-baseline gap-1">
            <span className={fieldLabel}>Permanent</span>
            <StatisticValue
              value={statistic.permanentValueLabel}
              size="text-base"
            />
          </span>
        </span>
      ) : (
        <StatisticValue value={statistic.valueLabel} />
      )}
      <span id={descriptionId} className={noteText}>
        {statistic.description}
      </span>
    </StatisticCell>
  );
}
