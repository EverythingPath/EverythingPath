'use client';
import type { ReactNode } from 'react';
import type { RawRoll } from '~/lib/weekly-draft-facts';
import { RollTotalField } from './roll-total-field';
import type { EventCheckFacts } from './types';
import { signed } from './upkeep-parts';

// One Event check: the dice total on the left, the calculated bonus, the
// total against the DC, the breakdown and the result beside it; stacked on
// a phone. Shared by every event family's checks. The entered dice never
// include the bonus. `support` hosts a control rendered under the row.
export function EventCheckRow({
  facts,
  recorded,
  disabled,
  onRoll,
  support,
}: {
  facts: EventCheckFacts;
  recorded: RawRoll | undefined;
  disabled: boolean;
  onRoll: (roll: RawRoll | null) => void;
  support?: ReactNode;
}) {
  return (
    // The dice field carries the visible label; the group repeats it for
    // assistive technology with the DC line beneath.
    <fieldset aria-label={facts.label} className="min-w-0 space-y-2">
      <p className="text-muted-foreground flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs [overflow-wrap:anywhere]">
        <span className="min-w-0">{facts.legend}</span>
        {facts.mandatory && (
          <span className="text-foreground rounded-full border px-2 py-0.5 font-medium">
            Mandatory
          </span>
        )}
      </p>
      <div className="grid min-w-0 items-start gap-x-6 gap-y-1 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
        <RollTotalField
          label={facts.label}
          spec={facts.spec}
          recorded={recorded}
          required={facts.required}
          disabled={disabled}
          onRoll={onRoll}
        />
        <div className="min-w-0 space-y-1 text-sm [overflow-wrap:anywhere] sm:pt-6">
          {facts.modifier === null ? (
            <p className="text-muted-foreground">
              The bonus is calculated once the event&apos;s other inputs are in.
            </p>
          ) : (
            <p className="flex flex-wrap gap-x-3">
              <span>
                Bonus{' '}
                <strong className="font-mono">{signed(facts.modifier)}</strong>
              </span>
              {facts.total !== null ? (
                <span>
                  = <strong className="font-mono">{facts.total}</strong> vs DC{' '}
                  {facts.dc}
                </span>
              ) : (
                <span className="text-muted-foreground">
                  vs DC {facts.dc} · total after the roll
                </span>
              )}
            </p>
          )}
          {facts.breakdown.length > 0 && (
            <p className="text-muted-foreground text-xs">
              {facts.breakdown
                .map((entry) => `${entry.label} ${signed(entry.value)}`)
                .join(' · ')}
            </p>
          )}
          {facts.resultText !== null && (
            <p>
              {facts.succeeded ? 'Success' : 'Failure'} · {facts.resultText}
            </p>
          )}
        </div>
      </div>
      {support}
    </fieldset>
  );
}
