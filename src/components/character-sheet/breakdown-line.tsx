'use client';
import type { ReactNode } from 'react';
import type { SourcedModifier } from '~/lib/character-sheet';
import { cn } from '~/lib/utils';
import { bonusTypeClasses, bonusTypeLabels } from './modifier-labels';
import { formatModifier } from './sheet-parts';

export const contributionKey = (contribution: SourcedModifier, index: number) =>
  `${contribution.sheetEntryId}|${contribution.bonusType}|${contribution.value}|${index}`;

function TypeTag({
  contribution,
  isDim,
}: {
  contribution: SourcedModifier;
  isDim?: boolean;
}) {
  const type = contribution.bonusType;
  if (type === 'untyped' || type === 'base') return null;
  return (
    <span
      className={cn(
        'shrink-0 font-mono text-[11px] whitespace-nowrap',
        isDim ? 'text-muted-foreground' : bonusTypeClasses[type],
      )}
    >
      {bonusTypeLabels[type]}
    </span>
  );
}

/** One contribution of a breakdown: its entry, bonus type and value. */
export function BreakdownLine({
  contribution,
  detail,
  isStruck,
  className,
  format = formatModifier,
}: {
  contribution: SourcedModifier;
  detail?: ReactNode;
  isStruck?: boolean;
  className?: string;
  format?: (value: number) => string;
}) {
  const struck = isStruck ? 'line-through' : '';
  return (
    <li className={className}>
      <div className="flex items-baseline gap-2">
        <span className={cn('min-w-0 flex-1 [overflow-wrap:anywhere]', struck)}>
          {contribution.entryName}
        </span>
        <TypeTag contribution={contribution} isDim={isStruck} />
        <span className={cn('shrink-0 font-mono whitespace-nowrap', struck)}>
          {format(contribution.value)}
        </span>
      </div>
      {detail ? (
        <div className="text-xs [overflow-wrap:anywhere]">{detail}</div>
      ) : null}
    </li>
  );
}
