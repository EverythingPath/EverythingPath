'use client';
import type { ResolvedStatistic } from '~/lib/character-sheet';
import { cn } from '~/lib/utils';
import { formatModifier } from './sheet-parts';
import { SheetStatistic } from './sheet-statistic';
import type { BreakdownTarget } from './stat-breakdown-content';

export type StatFigure = {
  /** The visible, short label. */
  label: string;
  /** The statistic's full name, in the number's accessible name. */
  title: string;
  target: BreakdownTarget;
  statistic: ResolvedStatistic;
  isSigned?: boolean;
};

// The row's rule runs under its labels; each number sits on that edge and
// covers its stretch of the rule with its own dotted underline.
const onRule = 'bg-card -mb-px self-end';

/**
 * One line of the Defenses or Offense block (approved prototype): a plain
 * label, the variants between it and the main figure, the main figure's
 * alternate totals in its Situations, and the main figure right-aligned so
 * the column lines up down the block. Every figure opens its breakdown.
 */
export function StatRow({
  figure,
  variants = [],
}: {
  figure: StatFigure;
  variants?: StatFigure[];
}) {
  return (
    <li className="border-foreground/15 flex items-end gap-3 border-b pt-1">
      <span className="flex min-w-0 flex-1 flex-wrap items-end gap-x-4">
        <span className="pb-1.5 text-sm leading-tight">{figure.label}</span>
        {variants.length > 0 ? (
          <span className="text-muted-foreground flex flex-wrap items-end gap-x-3 text-xs">
            {variants.map((variant) => (
              <span key={variant.title} className="inline-flex items-end gap-1">
                <span className="pb-1.5 leading-tight">{variant.label}</span>
                <SheetStatistic
                  label={variant.title}
                  statistic={variant.statistic}
                  target={variant.target}
                  format={variant.isSigned ? formatModifier : String}
                  className={cn(onRule, 'text-foreground min-h-7 text-sm')}
                />
              </span>
            ))}
          </span>
        ) : null}
      </span>
      <SheetStatistic
        label={figure.title}
        statistic={figure.statistic}
        target={figure.target}
        format={figure.isSigned ? formatModifier : String}
        className={cn(onRule, 'min-w-12 justify-end text-xl')}
        alternates={{ className: 'max-w-[55%] self-end pb-1' }}
      />
    </li>
  );
}

type StatRowProps = Parameters<typeof StatRow>[0];

/** Rows in groups set apart by space. */
export function StatGroups({
  groups,
}: {
  groups: { key: string; rows: StatRowProps[] }[];
}) {
  return (
    <div>
      {groups.map((group) => (
        <ul key={group.key} className="py-3 first:pt-0 last:pb-0">
          {group.rows.map((row) => (
            <StatRow key={row.figure.title} {...row} />
          ))}
        </ul>
      ))}
    </div>
  );
}
