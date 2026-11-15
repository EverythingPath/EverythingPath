'use client';
import { X } from 'lucide-react';
import { useRef, type ReactNode, type RefObject } from 'react';
import type { ResolvedStatistic } from '~/lib/character-sheet';
import {
  BreakdownExplanation,
  type BreakdownTarget,
} from './stat-breakdown-content';
import { cn } from '~/lib/utils';
import { fieldLabel } from './sheet-parts';
import { useBreakdownPlacement } from './use-breakdown-placement';

/**
 * The open explanation: a labelled group under its number that repeats the
 * number large, offers a close button, and says why it is what it is.
 */
export function StatBreakdownPanel({
  id,
  label,
  total,
  statistic,
  target,
  format,
  formatContribution,
  lead,
  explanation,
  incompleteReason,
  isPartial = false,
  trigger,
  onClose,
}: {
  id: string;
  label: string;
  total: ReactNode;
  statistic: ResolvedStatistic;
  target?: BreakdownTarget;
  format?: (total: number) => string;
  formatContribution?: (value: number) => string;
  /** Replaces the ordinary explanation, as for a number in a Situation. */
  explanation?: ReactNode;
  lead?: ReactNode;
  incompleteReason: string | null;
  /** The total is unresolved; the contributions below are only those known. */
  isPartial?: boolean;
  trigger: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useBreakdownPlacement(trigger, panel);
  return (
    <div
      ref={panel}
      id={id}
      role="group"
      aria-label={`${label} breakdown`}
      className="bg-background border-foreground/40 absolute top-full z-50 mt-1 w-[min(22rem,calc(100vw-1rem))] border p-3 text-left text-sm font-normal normal-case shadow-xl"
    >
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="min-w-0 font-sans [overflow-wrap:anywhere]">
          {label}
        </span>
        <span className="font-mono text-2xl">{total}</span>
        <button
          type="button"
          aria-label="Close breakdown"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground -mr-1 shrink-0 p-1"
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>
      {incompleteReason ? (
        <p className="mb-2 text-xs text-amber-300">{incompleteReason}</p>
      ) : null}
      {lead ? <div className="mb-2">{lead}</div> : null}
      {isPartial ? (
        <p className={cn(fieldLabel, 'mb-1')}>Known contributions (partial)</p>
      ) : null}
      {explanation ?? (
        <BreakdownExplanation
          statistic={statistic}
          target={target}
          format={format}
          formatContribution={formatContribution}
        />
      )}
    </div>
  );
}
