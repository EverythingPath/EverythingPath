'use client';
import type { ComponentProps, ReactNode } from 'react';
import { StatBreakdown } from './stat-breakdown';
import { SituationalTotals } from './situational-totals';

type Props = ComponentProps<typeof StatBreakdown> & {
  alternates?: Pick<
    ComponentProps<typeof SituationalTotals>,
    'isStacked' | 'className'
  >;
  /** Preserve a number site's existing grouping around its alternates. */
  children?: (number: ReactNode, alternates: ReactNode) => ReactNode;
};

/** The ordinary number and its fresh Situation totals share one set of inputs. */
export function SheetStatistic({ alternates, children, ...props }: Props) {
  const number = <StatBreakdown {...props} />;
  const totals =
    alternates && props.target ? (
      <SituationalTotals
        label={props.label}
        statistic={props.statistic}
        target={props.target}
        format={props.format}
        formatContribution={props.formatContribution}
        lead={props.lead}
        incompleteReason={props.incompleteReason}
        {...alternates}
      />
    ) : null;
  return children ? (
    children(number, totals)
  ) : (
    <>
      {number}
      {totals}
    </>
  );
}
